from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

server = ThreadingHTTPServer(("127.0.0.1", 8000), SimpleHTTPRequestHandler)
print("Servidor em http://127.0.0.1:8000")
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.shutdown()
