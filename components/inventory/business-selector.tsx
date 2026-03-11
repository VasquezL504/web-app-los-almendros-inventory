import { useState } from "react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Settings, Trash, Store } from "lucide-react"

interface BusinessSelectorProps {
	businesses: { id: string; name: string }[]
	selectedId: string
	onSelect: (id: string) => void
	onManage: () => void
	onDelete: (id: string) => void
	minimal?: boolean
}

export function BusinessSelector({ businesses, selectedId, onSelect, onManage, onDelete, minimal }: BusinessSelectorProps) {
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

	// Balanced style: integrated, menu-like, dropdown only on hover, with subtle icon
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<span
					className={
						minimal
							? "text-lg font-semibold tracking-tight text-foreground sm:text-xl cursor-pointer transition hover:text-primary flex items-center gap-2"
							: ""
					}
					style={minimal ? { border: "none", background: "none", padding: 0 } : {}}
				>
					<Store className="size-5 text-muted-foreground" />
					{businesses.find(b => b.id === selectedId)?.name || "Selecciona negocio"}
				</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className={minimal ? "min-w-[220px] shadow-lg border-none" : ""}>
				{businesses.map(b => (
					<DropdownMenuItem
						key={b.id}
						onClick={() => onSelect(b.id)}
						className={selectedId === b.id ? "font-semibold text-primary" : ""}
					>
						{b.name}
						{selectedId === b.id && " ✓"}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={onManage}>
					<Settings className="size-4 mr-2" /> Administrar negocios
				</DropdownMenuItem>
				{confirmDelete && (
					<DropdownMenuItem className="text-destructive" onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }}>
						<Trash className="size-4 mr-2" /> Confirmar eliminar
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
