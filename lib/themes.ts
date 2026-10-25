import type { Prefs } from "./prefs";
export type StudioTheme = { id: string; name: string; description: string; accent: string; secondary: string; bg: string; panel: string; mode: Prefs["theme"]; pattern: string };
export const STUDIO_THEMES: StudioTheme[] = [
 {id:"aurora",name:"Aurora Dark",description:"Cinematic ribbons of violet and gold",accent:"#9164ff",secondary:"#f0b85d",bg:"7 11 23",panel:"15 22 39",mode:"dark",pattern:"ribbons"},
 {id:"midnight",name:"Midnight Pro",description:"Precision blue. Quiet confidence.",accent:"#409bff",secondary:"#14c8e3",bg:"5 12 23",panel:"12 24 41",mode:"dark",pattern:"grid"},
 {id:"gold",name:"Gold Elite",description:"Warm metallic light on obsidian",accent:"#dba943",secondary:"#ffdb91",bg:"15 12 8",panel:"28 23 15",mode:"dark",pattern:"ribbons"},
 {id:"neon",name:"Neon Tech",description:"Electric violet meets cyan",accent:"#c45cff",secondary:"#00e9ed",bg:"10 5 25",panel:"24 13 43",mode:"dark",pattern:"grid"},
 {id:"nature",name:"Nature Flow",description:"Soft sage and forest sunlight",accent:"#277d66",secondary:"#b5cf69",bg:"228 238 229",panel:"245 250 244",mode:"light",pattern:"orbs"},
 {id:"minimal",name:"Minimal Light",description:"An airy canvas for focused work",accent:"#356ce0",secondary:"#b49bff",bg:"239 242 250",panel:"255 255 255",mode:"light",pattern:"orbs"},
 {id:"sunset",name:"Sunset Cinema",description:"Amber light and rose horizons",accent:"#ed8562",secondary:"#bd5ce0",bg:"24 12 24",panel:"39 23 36",mode:"dark",pattern:"ribbons"},
 {id:"ocean",name:"Ocean Glass",description:"Deep water with luminous currents",accent:"#28c4ca",secondary:"#3975f4",bg:"4 20 29",panel:"12 34 44",mode:"dark",pattern:"orbs"},
 {id:"rose",name:"Rose Quartz",description:"Blush glass with a softer edge",accent:"#b64878",secondary:"#d9a457",bg:"247 233 239",panel:"255 247 250",mode:"light",pattern:"ribbons"},
 {id:"mono",name:"Carbon Studio",description:"Restrained silver on true black",accent:"#8696ab",secondary:"#c9d1df",bg:"3 4 6",panel:"15 17 21",mode:"oled",pattern:"grid"},
];
