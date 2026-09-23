using UnityEngine;

public sealed class SimpleMovement : MonoBehaviour
{
    [SerializeField] private float speed = 5f;

    private void Update()
    {
        var axis = new Vector3(Input.GetAxisRaw("Horizontal"), 0f, Input.GetAxisRaw("Vertical"));
        if (axis.sqrMagnitude > 1f) axis.Normalize();
        transform.position += axis * speed * Time.deltaTime;
    }
}
