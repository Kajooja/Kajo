import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isItemInteraction,
  isRecord,
  type ItemActionCommand,
  type ItemActionReceipt,
} from './itemActionCommands';

export type ItemActionResult<TReceipt = ItemActionReceipt> =
  | { status: 'success'; receipt: TReceipt }
  | { status: 'error'; retryable: boolean; message: string; waitingForExposure?: boolean; rejectedUndo?: boolean; rejectedAction?: boolean };

export function createItemActionSender(client: SupabaseClient) {
  return async (command: ItemActionCommand): Promise<ItemActionResult> => {
    try {
      // The immutable actor in the envelope is checked against auth.uid() on
      // the server, even if the client's current auth session has changed.
      const { data, error } = await client.rpc('commit_item_action_v1', { request: command });
      if (error) {
        if (error.code === 'KJ001' && command.kind === 'UNDO') {
          return { status: 'error', retryable: false, rejectedUndo: true,
            message: 'Peruminen vanhentui, koska valinta oli jo muuttunut. Voit hylätä perumisen ja ladata nykytilan.' };
        }
        const permanent = /^(22|23|42)/.test(error.code ?? '') || error.code === 'PGRST202';
        return { status: 'error', retryable: !permanent, message: permanent
          ? 'Valintaa ei vielä voitu vahvistaa. Tarkista profiilin käyttöoikeus ja yritä uudelleen.'
          : 'Valinta odottaa yhteyttä. Yritämme tallennusta uudelleen.' };
      }
      if (!isRecord(data) || data.version !== 1 || data.actionId !== command.actionId
        || data.profileId !== command.profileId || data.itemId !== command.itemId
        || !isItemInteraction(data.interaction)) {
        return { status: 'error', retryable: false, message: 'Tallennuksen vahvistus oli puutteellinen. Valinta säilyy odottamassa.' };
      }
      return { status: 'success', receipt: data as unknown as ItemActionReceipt };
    } catch {
      return { status: 'error', retryable: true, message: 'Valinta odottaa yhteyttä. Yritämme tallennusta uudelleen.' };
    }
  };
}
