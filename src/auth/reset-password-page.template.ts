import { AUTH_ROUTES, AUTH_TEMPLATE_KEYS } from './auth.constants';

export const RESET_PASSWORD_PAGE_TEMPLATE = `
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Redefinir senha</title>
        <style>
          body { font-family: Arial, sans-serif; background: #0b1020; color: #fff; margin: 0; }
          .wrap { max-width: 420px; margin: 8vh auto; padding: 24px; background: #121a33; border-radius: 12px; }
          h1 { margin-top: 0; font-size: 24px; }
          label { display: block; margin: 12px 0 6px; }
          input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #38456f; background: #0f1630; color: #fff; }
          button { margin-top: 16px; width: 100%; padding: 12px; border: 0; border-radius: 8px; background: #4f7cff; color: #fff; font-weight: bold; cursor: pointer; }
          .ok { color: #85ffa0; margin-top: 12px; }
          .err { color: #ff8f8f; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Redefinir senha</h1>
          <label>Nova senha</label>
          <input id="password" type="password" minlength="6" />
          <label>Confirmar nova senha</label>
          <input id="confirmPassword" type="password" minlength="6" />
          <button id="submit">Atualizar senha</button>
          <div id="result"></div>
        </div>

        <script>
          const token = ${AUTH_TEMPLATE_KEYS.resetTokenPlaceholder};
          const submit = document.getElementById('submit');
          const result = document.getElementById('result');

          submit.addEventListener('click', async () => {
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            result.className = '';
            result.textContent = 'Processando...';

            try {
              const response = await fetch('${AUTH_ROUTES.resetPassword}', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password, confirmPassword }),
              });

              const data = await response.json();
              if (!response.ok) {
                result.className = 'err';
                result.textContent = data.message || 'Falha ao redefinir senha';
                return;
              }

              result.className = 'ok';
              result.textContent = data.message || 'Senha redefinida com sucesso';
            } catch (error) {
              result.className = 'err';
              result.textContent = 'Erro de conexao com a API';
            }
          });
        </script>
      </body>
      </html>
    `;
