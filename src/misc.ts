export function ltrim(subject: string, characters = ' \\s\u00A0') {
  characters = (characters + '').replace(/([[\]().?/*{}+$^:])/g, '$1')
  const re = new RegExp('^[' + characters + ']+', 'g')
  return (subject + '')
    .replace(re, '')
}

export function rtrim(subject: string, characters = ' \\s\u00A0') {
  characters = (characters + '').replace(/([[\]().?/*{}+$^:])/g, '\\$1')
  const re = new RegExp('[' + characters + ']+$', 'g')
  return (subject + '').replace(re, '')
}


export async function sha256String(text: string) {
  return await hashString(text, "SHA-256");
}

export async function sha1String(text: string) {
  return await hashString(text, "SHA-1");
}

async function hashString(text: string, algo: string) {
  const fileUint8 = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest(algo, fileUint8);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
} 

export function getHomeDir(): Promise<string> {
  const home = Deno.env.get("HOME") || Deno.env.get("HOMEPATH");
  if (typeof home != "string" || home.length < 1) {
    throw "Failed to locatie home directory...";
  }
  return Promise.resolve(home);
}
