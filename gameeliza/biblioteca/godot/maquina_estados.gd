extends Node
## Máquina de estados pequena para personagem ou inimigo.
var state := "idle"

func change_state(next_state: String) -> void:
    if next_state == state:
        return
    var previous := state
    state = next_state
    print("Estado: ", previous, " -> ", state)

func update_state(input_axis: float, grounded: bool) -> void:
    if not grounded:
        change_state("air")
    elif abs(input_axis) > 0.1:
        change_state("run")
    else:
        change_state("idle")
