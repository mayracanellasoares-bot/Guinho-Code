import time

FPS = 60
STEP = 1.0 / FPS
running = True
previous = time.perf_counter()
accumulator = 0.0

while running:
    now = time.perf_counter()
    accumulator += min(now - previous, 0.25)
    previous = now
    while accumulator >= STEP:
        # update(STEP)
        accumulator -= STEP
    # render(accumulator / STEP)
    time.sleep(0.001)
