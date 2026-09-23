extends CharacterBody2D
## Movimento básico com gravidade, aceleração e limite horizontal.
@export var speed := 220.0
@export var acceleration := 1200.0
@export var gravity := 1200.0

func _physics_process(delta: float) -> void:
    var axis := Input.get_axis("ui_left", "ui_right")
    velocity.x = move_toward(velocity.x, axis * speed, acceleration * delta)
    if not is_on_floor():
        velocity.y += gravity * delta
    elif Input.is_action_just_pressed("ui_accept"):
        velocity.y = -420.0
    move_and_slide()
