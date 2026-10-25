import { useState } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export interface ActionMenuItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  separatorBefore?: boolean
  onSelect: () => void
}

/**
 * A menu of commands. Items stay mounted through the whole click (the default menu unmounts on
 * pointer-up, which swallows React's click on touch and mouse) and the menu closes itself afterwards.
 */
export function ActionMenu({ trigger, triggerContent, items, contentProps, itemClassName }: { trigger: ReactElement; triggerContent: ReactNode; items: ActionMenuItem[]; contentProps?: Omit<ComponentProps<typeof DropdownMenuContent>, 'children'>; itemClassName?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={trigger}>{triggerContent}</DropdownMenuTrigger>
      <DropdownMenuContent {...contentProps}>
        {items.map((item) => (
          <div key={item.key}>
            {item.separatorBefore && <DropdownMenuSeparator />}
            <DropdownMenuItem
              closeOnClick={false}
              className={itemClassName}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.icon} {item.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
