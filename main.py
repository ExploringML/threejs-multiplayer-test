from fasthtml.common import *
from collections import deque
import asyncio
import json
import uuid
import random

# Create the importmap script
threejs_import = Script("""
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.174.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.174.0/examples/jsm/"
  }
}
""", type="importmap")
css = Style("""body { margin: 0; overflow: hidden; }""")

# Set up your app with the script in headers
app, rt = fast_app(static_path=".", hdrs=(threejs_import, css,), exts='ws')

# Store chat messages
messages = deque(maxlen=15)

# Track users and their positions
users = {}  # Format: {user_id: {"send": send_function, "position": position_string, "color": color}}

# Generate a random color for new users
def generate_random_color():
    r = random.randint(0, 255)
    g = random.randint(0, 255)
    b = random.randint(0, 255)
    return f"0x{r:02x}{g:02x}{b:02x}"

# Generate a random starting position for new users
def generate_random_position():
    # Generate random x and z coordinates within a reasonable range of the floor
    # Keep y coordinate fixed at 0.5 (half the cube height) to place cube on floor
    x = round(random.uniform(-8, 8), 2)  # Range of -8 to 8 for x coordinate
    z = round(random.uniform(-8, 8), 2)  # Range of -8 to 8 for z coordinate
    return f"POS:{x},0.5,{z}"  # Keep y at 0.5 to stay on the floor

# Takes all the messages and renders them
box_style = "border: 1px solid #ccc; border-radius: 10px; padding: 10px; margin: 5px 0;"
def render_messages(messages, user_positions=None):
    rendered_messages = []
    
    # Include all user positions if available
    if user_positions:
        # Convert the positions dict to JSON for the client to parse
        print(f"Sending positions data: {user_positions}")
        positions_json = json.dumps(user_positions)
        rendered_messages.append(Div(
            positions_json,
            id='position-updates',
            data_type='positions',
            style="display: none;"  # Hidden from view but accessible to JavaScript
        ))
    
    # Add regular chat messages
    for m in messages:
        # Only include messages that aren't position updates
        if not m.startswith('POS:'):
            rendered_messages.append(Div(m, style=box_style))
    
    return Div(*rendered_messages, id='msg-list')

# Input field is reset via hx_swap_oob after submitting a message
def mk_input(): return Input(id='msg', placeholder="Type your message", value="", hx_swap_oob="true")

@rt
def index():
    return Titled("Three.js Multiplayer Demo"),Script(src='js/main.js', type='module'), Div(
        Form(mk_input(), ws_send=True), # input fields
        P("Leave a message for others or move your cube with WASD/arrow keys!"),
        Div(render_messages(messages), id='msg-list'), # All the Messages
        hx_ext='ws', ws_connect='ws') # Use a web socket 

async def on_connect(ws, send):
    # Generate a unique ID for this user
    user_id = str(uuid.uuid4())
    print(f"New user connected: {user_id}")
    
    # Assign random color for this user's cube
    user_color = generate_random_color()
    print(f"Assigned color {user_color} to user {user_id}")
    
    # Generate random starting position
    random_position = generate_random_position()
    print(f"Random starting position for user {user_id}: {random_position}")
    
    # Store the user with their send function
    users[user_id] = {
        "send": send,
        "position": random_position,  # Random starting position
        "color": user_color
    }
    
    # Set client_id as a property of the websocket for later reference
    ws.client_id = user_id
    
    # Create a dictionary of all user positions to send to the new client
    user_positions = {uid: {"position": user_data["position"], "color": user_data["color"]} 
                     for uid, user_data in users.items()}
    
    print(f"Current users: {list(users.keys())}")
    print(f"Sending positions to new user: {user_positions}")
    
    # Send the current state to the new user, including their own ID
    await send(Input(id='client-id', value=user_id, style="display: none;", hx_swap_oob="true"))
    await send(render_messages(messages, user_positions))
    
    # Notify other clients about the new user
    for uid, user_data in users.items():
        if uid != user_id:  # Don't send to the new user again
            asyncio.create_task(user_data["send"](render_messages(messages, user_positions)))

def on_disconnect(ws):
    # Remove the user when they disconnect
    if hasattr(ws, 'client_id'):
        users.pop(ws.client_id, None)
        
        # Broadcast the updated user list to all remaining users
        user_positions = {uid: {"position": user_data["position"], "color": user_data["color"]} 
                         for uid, user_data in users.items()}
        
        # Broadcast to all connected users
        for user_data in users.values():
            asyncio.create_task(user_data["send"](render_messages(messages, user_positions)))

@app.ws('/ws', conn=on_connect, disconn=on_disconnect)
async def ws(msg:str, send, ws):
    await send(mk_input())  # reset the input field immediately
    
    # Get the client ID from the websocket
    client_id = getattr(ws, 'client_id', None)
    
    if client_id is None or client_id not in users:
        print(f"Unknown user or missing client_id")
        return  # Skip if we can't identify the user
    
    # Check if this is a position update (starts with POS:)
    if msg.startswith('POS:'):
        # Update the user's position
        users[client_id]["position"] = msg
        print(f"Updated position for user {client_id}: {msg}")
    else:
        # It's a regular chat message, store it
        messages.appendleft(msg)
        print(f"New chat message from {client_id}: {msg}")
    
    # Create a dictionary of all user positions
    user_positions = {uid: {"position": user_data["position"], "color": user_data["color"]} 
                     for uid, user_data in users.items()}
    
    # Broadcast messages and positions to all connected users
    print(f"Broadcasting positions: {user_positions}")
    for uid, user_data in users.items():
        asyncio.create_task(user_data["send"](render_messages(messages, user_positions)))

serve()