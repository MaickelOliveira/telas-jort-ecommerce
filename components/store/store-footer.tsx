import Image from "next/image";
import Link from "next/link";
import { getStoreSettings } from "@/lib/store-settings";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.4" cy="6.7" r="1.2" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.8 22v-8.8h3l.45-3.4H13.8V7.65c0-.98.27-1.65 1.68-1.65h1.92V3.1a22 22 0 0 0-2.5-.14c-2.48 0-4.18 1.51-4.18 4.3V9.8H8v3.4h2.72V22h3.08Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.273.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.892-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.99c-.002 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.478-8.413Z" />
    </svg>
  );
}

export function StoreFooter() {
  const store = getStoreSettings();
  const address = `${store.address}, ${store.number} - ${store.district}, ${store.city} - ${store.state}, ${store.postalCode}`;

  return (
    <footer className="tj-site-footer">
      <div className="tj-footer-social">
        <div className="tj-page-width tj-footer-social__links">
          <a href={store.instagram || "#"} target="_blank" rel="noreferrer" aria-label="Instagram">
            <InstagramIcon />
          </a>
          <a href="#" aria-label="Facebook">
            <FacebookIcon />
          </a>
        </div>
      </div>

      <div className="tj-footer-main">
        <div className="tj-page-width">
          <div className="tj-footer-grid">
            <div>
              <h2 className="tj-footer-title">Departamentos</h2>
              <ul className="tj-footer-links">
                <li><Link href="/produtos?categoria=Arames">Arames</Link></li>
                <li><Link href="/produtos?categoria=Telas">Telas</Link></li>
                <li><Link href="/produtos?categoria=Acessórios">Acessórios</Link></li>
                <li><Link href="/produtos?categoria=Ferramentas">Ferramentas</Link></li>
                <li><Link href="/produtos?categoria=EPIs">EPIs</Link></li>
              </ul>
            </div>

            <div>
              <h2 className="tj-footer-title">Institucional</h2>
              <ul className="tj-footer-links">
                <li><Link href="/quem-somos">Quem somos</Link></li>
                <li><Link href="/trocas-e-devolucoes">Trocas e Devoluções</Link></li>
                <li><Link href="/politica-de-privacidade">Política de Privacidade</Link></li>
                <li><Link href="/termos">Termos de Uso</Link></li>
              </ul>
            </div>

            <div>
              <h2 className="tj-footer-title">Entre em contato</h2>
              <ul className="tj-footer-links">
                <li>Atendimento via WhatsApp</li>
                <li>{store.phone}</li>
                <li><a href={`mailto:${store.email}`}>{store.email}</a></li>
                <li>{address}</li>
              </ul>
            </div>

            <div>
              <h2 className="tj-footer-title">Newsletter</h2>
              <form className="tj-footer-newsletter" action="/contato">
                <label className="tj-visually-hidden" htmlFor="footer-newsletter">Cadastre seu e-mail</label>
                <input id="footer-newsletter" name="email" type="email" placeholder="Cadastre seu e-mail..." required />
                <button className="tj-button tj-button--light" type="submit">Enviar</button>
              </form>
              <Link className="tj-footer-logo" href="/">
                <Image src="/assets/images/storefront/logo-telas-jort.webp" alt="Telas Jort" width={360} height={127} />
              </Link>
            </div>
          </div>

          <div className="tj-footer-payments">
            <div><h2 className="tj-footer-title">Meios de pagamento</h2><span>Visa · Mastercard · Elo · Pix · Boleto</span></div>
            <div><h2 className="tj-footer-title">Meios de envio</h2><span>Transportadora e retirada na loja</span></div>
          </div>
        </div>
      </div>

      <div className="tj-footer-bottom">
        <div className="tj-page-width">Copyright {store.name} - {store.cnpj} - 2026. Todos os direitos reservados.</div>
      </div>

      <a
        className="tj-floating-whatsapp"
        href={`https://wa.me/${store.whatsapp}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco pelo WhatsApp"
      >
        <WhatsAppIcon />
      </a>
    </footer>
  );
}
