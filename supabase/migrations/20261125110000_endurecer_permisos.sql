-- No borra nada: solo ajusta permisos.
revoke execute on function public.crear_lead_formulario(jsonb) from anon, authenticated;   -- v1 ya no se usa: todo entra por lead-intake
revoke execute on function public.registrar_senales(text, jsonb) from authenticated;         -- solo el radar (anon + token)
revoke execute on function public.enlaces_vistos(text) from authenticated;
alter function public.dia_laborable_siguiente(date) set search_path = '';
