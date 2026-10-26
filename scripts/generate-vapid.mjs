// Génère une paire de clés VAPID pour les notifications push : npm run vapid
// Copier la sortie dans .env.local et dans les variables d'environnement Vercel.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
