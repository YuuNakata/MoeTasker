// lib/utils/htmlEscaper.js
export function escapeHTML(text) {
    if (typeof text !== 'string') return String(text); // Convertir a string si no lo es
    return text.replace(/&/g, "&").replace("<",/</g).replace(">",/>/g).replace(/"/g, '"').replace(/'/g, "'");
  }
  
  // También podemos tener helpers para tags comunes
  export function bold(text) {
    return `<b>${escapeHTML(String(text))}</b>`;
  }
  
  export function italic(text) {
    return `<i>${escapeHTML(String(text))}</i>`;
  }
  
  export function code(text) {
    return `<code>${escapeHTML(String(text))}</code>`;
  }
  
  export function link(text, url) {
    return `<a href="${escapeHTML(url)}">${escapeHTML(String(text))}</a>`;
  }
  
  export function mention(text, userId) {
    return `<a href="tg://user?id=${userId}">${escapeHTML(String(text))}</a>`;
  }