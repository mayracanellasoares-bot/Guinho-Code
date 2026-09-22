export default async function handler(req, res) {
  const key = process.env.NVIDIA_API_KEY || process.env.NVIDIA_KEY;
  if (!key) {
    res.status(500).json({ ok: false, provider: 'nvidia', error: 'Missing NVIDIA_API_KEY' });
    return;
  }

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });
    const raw = await response.text();
    if (!response.ok) {
      res.status(response.status).json({
        ok: false,
        provider: 'nvidia',
        status: response.status,
        error: raw.slice(0, 500)
      });
      return;
    }

    const data = JSON.parse(raw);
    res.status(200).json({
      ok: true,
      provider: 'nvidia',
      modelsAvailable: Array.isArray(data.data) ? data.data.length : 0
    });
  } catch (error) {
    res.status(502).json({ ok: false, provider: 'nvidia', error: error.message });
  }
}
