export function ltrim(subject: string, characters: string = ' \\s\u00A0') {
  characters = (characters + '').replace(/([[\]().?/*{}+$^:])/g, '$1')
  const re = new RegExp('^[' + characters + ']+', 'g')
  return (subject + '')
    .replace(re, '')
}

export function rtrim(subject: string, characters: string = ' \\s\u00A0') {
  characters = (characters + '').replace(/([[\]().?/*{}+$^:])/g, '\\$1')
  const re = new RegExp('[' + characters + ']+$', 'g')
  return (subject + '').replace(re, '')
}


export async function sha256String(text: string) {
  const fileUint8 = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", fileUint8);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
