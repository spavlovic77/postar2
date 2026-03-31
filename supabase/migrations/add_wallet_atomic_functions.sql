-- Atomic wallet deduct: prevents race conditions by doing
-- read + write in a single UPDATE statement.
-- Returns new balance, or NULL if insufficient funds.
create or replace function wallet_deduct(p_wallet_id uuid, p_amount numeric)
returns numeric as $$
declare
  new_bal numeric;
begin
  update wallets
    set available_balance = available_balance - p_amount,
        updated_at = now()
    where id = p_wallet_id
      and available_balance >= p_amount
    returning available_balance into new_bal;

  return new_bal;
end;
$$ language plpgsql security definer set search_path = public;

-- Atomic wallet credit: same approach for adding funds.
-- Returns new balance, or NULL if wallet not found.
create or replace function wallet_credit(p_wallet_id uuid, p_amount numeric)
returns numeric as $$
declare
  new_bal numeric;
begin
  update wallets
    set available_balance = available_balance + p_amount,
        updated_at = now()
    where id = p_wallet_id
    returning available_balance into new_bal;

  return new_bal;
end;
$$ language plpgsql security definer set search_path = public;
