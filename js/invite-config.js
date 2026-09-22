/* Settings for the invitation email that are not secret.

   The payment details are deliberately NOT here: every file in this project is
   served to the public, so they live in the database and the coach types them
   on the admin page (⚙ Datos del pago). */

/* Where the mail comes from and where a reply goes. The domain has to be
   verified with the mail provider first, or everything lands in spam. */
export const FROM = 'BE PRO Futbol <registros@bepro.futbol>';
export const REPLY_TO = 'registros@bepro.futbol';

export const WHATSAPP = '17028319474';

/* How long the parent's permission link stays open, in days. */
export const PARENT_LINK_DAYS = 30;
