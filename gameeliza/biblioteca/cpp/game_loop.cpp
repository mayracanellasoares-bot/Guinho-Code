#include <chrono>

int main() {
    using clock = std::chrono::steady_clock;
    constexpr double step = 1.0 / 60.0;
    auto previous = clock::now();
    double accumulator = 0.0;
    for (;;) {
        auto now = clock::now();
        accumulator += std::chrono::duration<double>(now - previous).count();
        previous = now;
        while (accumulator >= step) {
            // update(step);
            accumulator -= step;
        }
        // render();
    }
}
