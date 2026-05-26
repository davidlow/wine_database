import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import type { BottleTransaction } from '@/types';
import { formatDate, cn } from '@/lib/utils';

interface Props {
  transactions: BottleTransaction[];
}

export default function TransactionLog({ transactions }: Props) {
  if (!transactions.length) {
    return <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>;
  }

  return (
    <div className="space-y-1">
      {transactions.map((t) => {
        const isAdd = t.transaction_type === 'add';
        const wineName = (t.wine as Record<string, unknown>)?.name as string | undefined;
        return (
          <div key={t.id} className="flex items-center gap-3 py-2 border-b last:border-0">
            {isAdd
              ? <ArrowUpCircle className="h-4 w-4 text-green-600 shrink-0" />
              : <ArrowDownCircle className="h-4 w-4 text-red-500 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">
                <span className={cn('font-medium', isAdd ? 'text-green-700' : 'text-red-600')}>
                  {isAdd ? '+' : '-'}{t.quantity}
                </span>
                {wineName && <span className="text-muted-foreground ml-1">· {wineName}</span>}
              </p>
              {t.location && <p className="text-xs text-muted-foreground truncate">{t.location}</p>}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{formatDate(t.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
