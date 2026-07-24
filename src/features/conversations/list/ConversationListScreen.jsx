import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { ChatCircleDots } from "@phosphor-icons/react/ChatCircleDots";
import { Lightning } from "@phosphor-icons/react/Lightning";
import { QrCode } from "@phosphor-icons/react/QrCode";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { Star } from "@phosphor-icons/react/Star";
import { UserPlus } from "@phosphor-icons/react/UserPlus";
import { WaveSine } from "@phosphor-icons/react/WaveSine";
import { Brand } from "../../../Brand";
import { Avatar } from "../../AuthenticatedShared";
import "../../../styles/conversations.css";

export function Hero({ child, onQr }) {
  return (
    <header className="hero">
      <div className="hero__decor" aria-hidden="true">
        <WaveSine className="decor decor--wave" size={32} weight="bold" />
        <Star className="decor decor--star" size={34} weight="fill" />
        <Lightning className="decor decor--bolt" size={42} weight="fill" />
        <Star className="decor decor--outline-star" size={38} weight="bold" />
      </div>
      <Brand />
      <div className="hero__main">
        <Avatar person={child} size="hero" />
        <div className="hero__copy">
          <h1>Salut, {child.name} !</h1>
          <p>Choisis une personne et commence à discuter.</p>
          <div className="secure-note">
            <ShieldCheck size={28} weight="fill" aria-hidden="true" />
            <span><strong>Espace sécurisé</strong><small>Tous tes contacts sont approuvés par un parent.</small></span>
          </div>
        </div>
        <button className="qr-action" type="button" onClick={onQr} aria-label="Ajouter un ami avec un QR code">
          <span className="qr-action__icon"><QrCode size={35} weight="bold" aria-hidden="true" /></span>
          <span>Ajouter<br />un ami</span>
        </button>
      </div>
    </header>
  );
}

export function FriendsStrip({ approvedFriends, onOpenFriend, onQr }) {
  return (
    <section className="friends-strip" aria-labelledby="friends-title">
      <div className="section-title-row">
        <div>
          <span>Conversations</span>
          <h2 id="friends-title">Avec qui veux-tu discuter ?</h2>
        </div>
      </div>
      <div className="friend-list">
        {approvedFriends.length === 0 && (
          <div className="empty-friends">
            <span className="empty-friends__icon"><UserPlus size={24} weight="fill" /></span>
            <div className="empty-friends__copy">
              <strong>Tes amis arriveront bientôt ici</strong>
              <ol>
                <li><span>1</span><p>Partage ton QR ou ton identifiant.</p></li>
                <li><span>2</span><p>Un parent confirme la demande.</p></li>
              </ol>
            </div>
            <button type="button" onClick={onQr}><QrCode size={18} weight="bold" /> Ajouter ou partager</button>
          </div>
        )}
        {approvedFriends.map((friend) => (
          <button key={friend.id} type="button" className="friend-chip" onClick={() => onOpenFriend(friend)}>
            <Avatar person={friend} size="friend" online={Boolean(friend.online)} />
            <span>{friend.name}<small>{friend.online ? "En ligne" : "Hors ligne"}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function ConversationList({ availableConversations, onOpen }) {
  return (
    <section className="conversation-section" aria-labelledby="recent-title">
      <div className="conversation-heading">
        <span className="heading-icon"><ChatCircleDots size={22} weight="fill" aria-hidden="true" /></span>
        <h2 id="recent-title">Tes discussions</h2>
      </div>
      <div className="conversation-list">
        {availableConversations.length === 0 && (
          <div className="empty-conversations">
            <UserPlus size={30} weight="fill" />
            <strong>Personne à qui écrire pour le moment</strong>
            <span>Ajoute un ami avec ton QR ou ton identifiant, puis un parent confirmera.</span>
          </div>
        )}
        {availableConversations.map((conversation) => {
          const ActivityIcon = conversation.ActivityIcon;
          return (
            <button key={conversation.id} type="button" className="conversation-row" onClick={() => onOpen(conversation)}>
              <Avatar person={conversation} size="list" online={Boolean(conversation.online)} />
              <span className="conversation-copy">
                <strong>{conversation.name}</strong>
                <span className="preview-text">{conversation.preview} <ActivityIcon size={16} weight="fill" aria-hidden="true" /></span>
              </span>
              <span className="conversation-meta">
                <time>{conversation.time}</time>
                <CaretRight size={17} weight="bold" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function HomeScreen({ child, approvedFriends, availableConversations, onQr, onOpenConversation }) {
  const openFriend = (friend) => {
    const matchingConversation = availableConversations.find((item) => item.id === friend.id || item.contactId === friend.contactId);
    if (matchingConversation) onOpenConversation(matchingConversation);
  };

  return (
    <div className="home-screen">
      <Hero child={child} onQr={onQr} />
      <FriendsStrip approvedFriends={approvedFriends} onOpenFriend={openFriend} onQr={onQr} />
      {availableConversations.length > 0 && <ConversationList availableConversations={availableConversations} onOpen={onOpenConversation} />}
    </div>
  );
}
