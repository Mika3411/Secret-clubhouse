import { ChatCircleDots } from "@phosphor-icons/react/ChatCircleDots";
import { GearSix } from "@phosphor-icons/react/GearSix";
import { House } from "@phosphor-icons/react/House";

export async function copyContactId(contactId) {
  try {
    await navigator.clipboard.writeText(contactId);
  } catch {
    // Le statut visuel reste utile dans ce prototype, même sans permission presse-papiers.
  }
}

export const defaultAvatar = { hair: "bob", hairColor: "brown", face: "smile", skin: "warm", outfit: "mint" };

export const avatarPalette = {
  skin: { light: "#f9d8c2", porcelain: "#f4cdb5", warm: "#eeb992", peach: "#dfa47d", tan: "#c98960", olive: "#b87955", caramel: "#a96d48", brown: "#925a3b", deep: "#704634", ebony: "#4d3028" },
  hairColor: { brown: "#6b3f2a", black: "#201b2c", blond: "#e8b94f", ginger: "#bd5b35", violet: "#6650c7", chestnut: "#8b4a38", pink: "#d86f9d", blue: "#436fc4", teal: "#278f8a", silver: "#aaa9bc" },
  outfit: { mint: "#69e4c3", violet: "#8c75e7", coral: "#ff8d83", sun: "#f5c451", blue: "#63b7e8", rose: "#e783ae", teal: "#42bdb2", navy: "#45478f", lilac: "#b99ae9", orange: "#ee9854" },
};

export function AvatarIllustration({ avatar = defaultAvatar, name = "Mon avatar" }) {
  const config = { ...defaultAvatar, ...avatar };
  const skin = avatarPalette.skin[config.skin];
  const hair = avatarPalette.hairColor[config.hairColor];
  const outfit = avatarPalette.outfit[config.outfit];
  return (
    <svg className="avatar-illustration" viewBox="0 0 120 120" role="img" aria-label={`Avatar personnalisé de ${name}`}>
      <circle cx="60" cy="60" r="60" fill="#d9d0ff" />
      <path d="M17 120c4-25 20-38 43-38s39 13 43 38" fill={outfit} />
      <path d="M39 80h42v20c-12 9-30 9-42 0z" fill={skin} />
      <ellipse cx="60" cy="54" rx="31" ry="35" fill={skin} />
      {config.hair === "short" && <path d="M30 48c0-28 18-38 34-36 19 2 28 18 26 39-8-14-21-18-35-16-10 2-18 7-25 13z" fill={hair} />}
      {config.hair === "bob" && <path d="M27 55c-2-28 13-45 34-45 23 0 37 17 34 48l-9 19-5-32c-15-13-30-10-44 1l-4 31z" fill={hair} />}
      {config.hair === "curly" && <g fill={hair}><circle cx="37" cy="30" r="14"/><circle cx="53" cy="21" r="15"/><circle cx="70" cy="22" r="15"/><circle cx="84" cy="34" r="14"/><circle cx="31" cy="48" r="12"/><circle cx="89" cy="50" r="12"/></g>}
      {config.hair === "spiky" && <path d="M29 49l5-27 9 9 5-21 12 15 12-18 4 22 15-9-3 32c-16-18-42-20-59-3z" fill={hair} />}
      {config.hair === "bun" && <><circle cx="61" cy="13" r="15" fill={hair}/><path d="M29 51c0-27 14-40 32-40s31 14 31 40c-17-18-43-18-63 0z" fill={hair}/></>}
      {config.hair === "long" && <path d="M26 55c-2-29 13-46 35-46 23 0 37 18 34 49l-5 35-12-8 3-42c-14-11-29-9-42 2l3 40-12 8z" fill={hair}/>}
      {config.hair === "braids" && <><path d="M29 50c0-26 14-40 32-40s31 14 31 40c-18-17-43-17-63 0z" fill={hair}/><path d="M31 48q-9 20 2 42M89 48q9 20-2 42" fill="none" stroke={hair} strokeWidth="8" strokeLinecap="round" strokeDasharray="5 3"/></>}
      {config.hair === "afro" && <g fill={hair}><circle cx="29" cy="43" r="17"/><circle cx="36" cy="25" r="18"/><circle cx="54" cy="15" r="18"/><circle cx="74" cy="17" r="18"/><circle cx="89" cy="32" r="18"/><circle cx="91" cy="51" r="15"/></g>}
      {config.hair === "ponytail" && <><circle cx="91" cy="31" r="17" fill={hair}/><path d="M29 51c0-27 14-41 32-41s31 14 31 41c-18-17-43-17-63 0z" fill={hair}/></>}
      {config.hair === "waves" && <path d="M27 58c-3-31 12-49 34-49 24 0 39 19 35 51-5-10-10-15-16-19-4 7-10 9-16 2-6 7-13 7-18 0-6 4-11 9-19 15z" fill={hair}/>}
      {!["happy", "laugh", "wink", "surprised", "star"].includes(config.face) && <><circle cx="48" cy="55" r="3.2" fill="#171044"/><circle cx="72" cy="55" r="3.2" fill="#171044"/></>}
      {config.face === "smile" && <path d="M50 69q10 9 20 0" fill="none" stroke="#8d4150" strokeWidth="3" strokeLinecap="round"/>}
      {config.face === "happy" && <><path d="M45 55q3-5 6 0M69 55q3-5 6 0" fill="none" stroke="#171044" strokeWidth="3" strokeLinecap="round"/><path d="M49 68q11 13 22 0" fill="#fff" stroke="#8d4150" strokeWidth="2"/></>}
      {config.face === "calm" && <path d="M52 70q8 3 16 0" fill="none" stroke="#8d4150" strokeWidth="3" strokeLinecap="round"/>}
      {config.face === "freckles" && <><path d="M50 69q10 8 20 0" fill="none" stroke="#8d4150" strokeWidth="3" strokeLinecap="round"/><g fill="#a8634f"><circle cx="40" cy="64" r="1.4"/><circle cx="45" cy="66" r="1.2"/><circle cx="80" cy="64" r="1.4"/><circle cx="75" cy="66" r="1.2"/></g></>}
      {config.face === "wink" && <><circle cx="48" cy="55" r="3.2" fill="#171044"/><path d="M68 55q4 3 8 0M50 69q10 8 20 0" fill="none" stroke="#171044" strokeWidth="3" strokeLinecap="round"/></>}
      {config.face === "laugh" && <><path d="M44 55q4-6 8 0M68 55q4-6 8 0" fill="none" stroke="#171044" strokeWidth="3" strokeLinecap="round"/><path d="M48 68q12 17 24 0z" fill="#8d4150"/></>}
      {config.face === "surprised" && <><circle cx="48" cy="55" r="3.2" fill="#171044"/><circle cx="72" cy="55" r="3.2" fill="#171044"/><circle cx="60" cy="72" r="5" fill="none" stroke="#8d4150" strokeWidth="3"/></>}
      {config.face === "shy" && <><path d="M52 70q8 5 16 0" fill="none" stroke="#8d4150" strokeWidth="3" strokeLinecap="round"/><circle cx="40" cy="66" r="5" fill="#e9969d" opacity=".55"/><circle cx="80" cy="66" r="5" fill="#e9969d" opacity=".55"/></>}
      {config.face === "star" && <><path d="M48 49l2 4 5 .5-4 3 1 5-4-2-4 2 1-5-4-3 5-.5zM72 49l2 4 5 .5-4 3 1 5-4-2-4 2 1-5-4-3 5-.5z" fill="#392b82"/><path d="M49 68q11 13 22 0" fill="#fff" stroke="#8d4150" strokeWidth="2"/></>}
      {config.face === "confident" && <><path d="M43 49l10-2M67 47l10 2M51 70q9 7 18 0" fill="none" stroke="#171044" strokeWidth="2.5" strokeLinecap="round"/></>}
      <path d="M60 58l-2 6h4" fill="none" stroke="#b87962" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M43 93l17 12 17-12" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  );
}

export function Avatar({ person, size = "medium", online = null }) {
  return (
    <span className={`avatar avatar--${size} avatar--tone-${person.color ?? "default"}`}>
      {person.avatar ? <AvatarIllustration avatar={person.avatar} name={person.name} /> : person.image ? <img src={person.image} alt={`Avatar de ${person.name}`} /> : <span className="avatar__fallback" role="img" aria-label={`Avatar de ${person.name}`}>{person.name.slice(0, 1)}</span>}
      {online !== null && <span className={`online-dot ${online ? "is-online" : "is-offline"}`} aria-label={online ? "En ligne" : "Hors ligne"} title={online ? "En ligne" : "Hors ligne"} />}
    </span>
  );
}

export function ParentModeNavigation({ active, unreadMessages = 0, onHome, onManagement, onConversations }) {
  const items = [
    { id: "home", label: "Accueil", Icon: House, onClick: onHome },
    { id: "management", label: "Gestion", Icon: GearSix, onClick: onManagement },
    { id: "conversations", label: "Conversations", Icon: ChatCircleDots, onClick: onConversations, badge: unreadMessages },
  ];

  return (
    <nav className="parent-mode-navigation" aria-label="Navigation du mode parent">
      {items.map(({ id, label, Icon, onClick, badge }) => (
        <button type="button" key={id} className={active === id ? "is-active" : ""} onClick={onClick} aria-current={active === id ? "page" : undefined}>
          <span><Icon size={20} weight={active === id ? "fill" : "bold"} />{badge > 0 && <em>{badge}</em>}</span>
          <strong>{label}</strong>
        </button>
      ))}
    </nav>
  );
}
