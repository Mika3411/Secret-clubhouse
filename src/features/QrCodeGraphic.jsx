import { QRCodeSVG } from "qrcode.react";

export function QrCodeGraphic({ value, childName, contactId }) {
  return (
    <QRCodeSVG
      value={value}
      size={132}
      level="H"
      marginSize={2}
      bgColor="#ffffff"
      fgColor="#120966"
      title={`Ajouter ${childName} avec l’identifiant ${contactId}`}
    />
  );
}
