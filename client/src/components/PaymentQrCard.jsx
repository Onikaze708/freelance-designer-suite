import { useEffect, useState } from "react";

export function PaymentQrCard({ link, title }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  useEffect(() => {
    let ignore = false;
    async function generateQr() {
      if (!link) { setQrDataUrl(""); return; }
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(link, { width: 240, margin: 1, color: { dark: "#14213D", light: "#FFFFFF" } });
      if (!ignore) setQrDataUrl(dataUrl);
    }
    generateQr();
    return () => { ignore = true; };
  }, [link]);

  return (
    <div className="panel p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-coral">Cobro rapido</p>
      <h3 className="mt-2 text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 break-all text-sm text-slate-500">{link || "Agrega un enlace de PayPal para generar el QR."}</p>
      {qrDataUrl ? <div className="mt-5 rounded-[28px] bg-sand p-5 text-center"><img src={qrDataUrl} alt="Codigo QR de pago" className="mx-auto h-56 w-56 rounded-3xl bg-white p-3" /><a className="button-soft mt-4" href={qrDataUrl} download="paypal-qr.png">Descargar QR</a></div> : null}
    </div>
  );
}