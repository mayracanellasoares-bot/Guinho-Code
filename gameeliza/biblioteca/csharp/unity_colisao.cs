using UnityEngine;

public sealed class DamageOnContact : MonoBehaviour
{
    [SerializeField] private int damage = 1;

    private void OnTriggerEnter2D(Collider2D other)
    {
        var target = other.GetComponent<Health>();
        if (target != null) target.ApplyDamage(damage);
    }
}
