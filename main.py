from fasthtml.common import *
from collections import deque
import asyncio

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

# Store chat messages and the latest position update
messages = deque(maxlen=15)
latest_position = None
users = {}

# Takes all the messages and renders them
box_style = "border: 1px solid #ccc; border-radius: 10px; padding: 10px; margin: 5px 0;"
def render_messages(messages, position=None):
    rendered_messages = []
    
    # Always include the latest position at the top if available
    if position:
        rendered_messages.append(Div(
            position,
            id='position-update',
            data_type='position',
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
        P("Leave a message for others or move the cube with WASD/arrow keys!"),
        Div(render_messages(messages, latest_position), id='msg-list'), # All the Messages
        hx_ext='ws', ws_connect='ws') # Use a web socket 

def on_connect(ws, send): 
    users[id(ws)] = send
    # When a new user connects, immediately send them the latest position if available
    if latest_position:
        # Immediately send the current position to the new user
        asyncio.create_task(send(render_messages(messages, latest_position)))

def on_disconnect(ws):
    users.pop(id(ws), None)

@app.ws('/ws', conn=on_connect, disconn=on_disconnect)
async def ws(msg:str, send):
    global latest_position
    
    await send(mk_input()) # reset the input field immediately
    
    # Check if this is a position update (starts with POS:)
    if msg.startswith('POS:'):
        # Update the latest position
        latest_position = msg
    else:
        # It's a regular chat message, store it
        messages.appendleft(msg)
    
    # Broadcast messages and position to all connected users
    for u in users.values():
        await u(render_messages(messages, latest_position))

serve()