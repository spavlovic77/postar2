-- Welcome credit amount (EUR) added to wallet on first Peppol activation.
-- Configurable from system settings UI. Set to 0 to disable.
insert into system_settings (key, value, description)
values ('welcome_credit_amount', '0.03', 'Welcome credit (EUR) added to wallet on first Peppol activation. Set to 0 to disable.')
on conflict (key) do nothing;
