from fasthtml.common import *

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
app, rt = fast_app(static_path=".", hdrs=(threejs_import, css,))

@rt("/")
def get():
    return Script(src='js/main.js', type='module')

serve()
