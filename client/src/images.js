export async function uploadImage(file, token) {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(`/api/images?token=${encodeURIComponent(token)}`, { method: 'POST', body: fd });
  if (!res.ok) { alert('העלאת התמונה נכשלה'); return null; }
  return (await res.json()).url;
}
