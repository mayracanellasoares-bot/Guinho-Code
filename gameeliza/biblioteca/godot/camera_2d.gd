extends Camera2D
## Câmera com suavização e limites de fase.
@export var target: Node2D
@export var follow_speed := 6.0

func _process(delta: float) -> void:
    if is_instance_valid(target):
        global_position = global_position.lerp(target.global_position, 1.0 - exp(-follow_speed * delta))
