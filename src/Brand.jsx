import { FlagPennant } from "@phosphor-icons/react/FlagPennant";
import { House } from "@phosphor-icons/react/House";

export function Brand() {
  return (
    <div className="brand" aria-label="Secret Clubhouse">
      <span className="brand-mark" aria-hidden="true">
        <FlagPennant size={43} weight="fill" />
        <House className="brand-mark__house" size={10} weight="fill" />
      </span>
      <span>Secret<br />Clubhouse</span>
    </div>
  );
}
