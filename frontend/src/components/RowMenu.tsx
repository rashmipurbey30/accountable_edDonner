import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface RowMenuProps {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}

/** The "⋯" menu with Edit and Delete (T5, A5). Clicks don't reach the row underneath. */
export function RowMenu({ label, onEdit, onDelete }: RowMenuProps) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className="icon-btn"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <MoreHorizontal aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" align="end" sideOffset={4} onClick={(e) => e.stopPropagation()}>
          <Menu.Item className="menu-item" onSelect={onEdit}>
            <Pencil aria-hidden="true" /> Edit
          </Menu.Item>
          <Menu.Item className="menu-item danger" onSelect={onDelete}>
            <Trash2 aria-hidden="true" /> Delete
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
