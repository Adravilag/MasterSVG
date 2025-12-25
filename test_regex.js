
const svg = `<svg viewBox="0 0 100 100"><style id="icon-manager-animation">@keyframes glow{0%,to{filter:drop-shadow(0 0 2px currentColor)}50%{filter:drop-shadow(0 0 10px currentColor) drop-shadow(0 0 20px currentColor)}}svg{animation:glow 1s ease infinite normal;transform-origin:center center}</style><defs><linearGradient id="a" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" style="stop-color:#89f7fe"/><stop offset="100%" style="stop-color:#66a6ff"/></linearGradient></defs><polygon fill="url(#a)" stroke="#fff" stroke-width="2" points="50,5 85,35 50,95 15,35"/><polygon fill="rgba(255,255,255,0.3)" points="50,5 35,35 50,35 65,35"/><line x1="35" x2="50" y1="35" y2="95" stroke="rgba(255,255,255,0.5)" stroke-width="1"/><line x1="65" x2="50" y1="35" y2="95" stroke="rgba(255,255,255,0.5)" stroke-width="1"/></svg>`;

const regex = /animation:\s*([\w-]+)\s+([\d.]+)s\s+([^\s]+)(?:\s+([\d.]+)s)?\s+([^\s]+)\s+([^\s;]+)/;
const match = svg.match(regex);

console.log('Match:', match);
if (match) {
    console.log('Type:', match[1]);
    console.log('Duration:', match[2]);
    console.log('Timing:', match[3]);
    console.log('Delay:', match[4]);
    console.log('Iteration:', match[5]);
    console.log('Direction:', match[6]);
}
