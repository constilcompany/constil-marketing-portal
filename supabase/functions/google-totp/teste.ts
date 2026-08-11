// test-sendgrid-fixed.ts
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

const env = await load();
const key = env.SENDGRID_API_KEY || Deno.env.get("SENDGRID_API_KEY");

console.log("SENDGRID_API_KEY:", key ? "✅ Configurada" : "❌ NÃO CONFIGURADA");

if (key) {
    // SUBSTITUA PELO SEU EMAIL VERIFICADO
    const fromEmail = "na2841090@gmail.com"; // <--- MUDE AQUI
    const toEmail = "fabiofb312@gmail.com";
    const testOtp = "123456";
    
    console.log(`📧 Enviando de: ${fromEmail} para: ${toEmail}`);
    
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: toEmail }] }],
            from: { email: fromEmail, name: "Constil Test" },
            subject: "Constil",
            content: [{ 
                type: "text/html", 
                value: `<h1>Seu código: ${testOtp}</h1><p>Este é um teste do SendGrid.</p>` 
            }],
        }),
    });

    console.log("📧 Status:", response.status);
    if (response.ok) {
        console.log("✅ Email enviado com sucesso!");
    } else {
        const error = await response.text();
        console.log("❌ Erro:", error);
    }
}