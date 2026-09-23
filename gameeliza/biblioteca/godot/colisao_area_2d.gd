extends Area2D
## Detecta o corpo que entrou e evita múltiplas notificações.
var already_hit := {}

func _on_body_entered(body: Node2D) -> void:
    if already_hit.has(body.get_instance_id()):
        return
    already_hit[body.get_instance_id()] = true
    print("Colisão com: ", body.name)

func _on_body_exited(body: Node2D) -> void:
    already_hit.erase(body.get_instance_id())
