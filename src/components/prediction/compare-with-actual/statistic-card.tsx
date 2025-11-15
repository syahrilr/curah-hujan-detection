import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatisticCardProps {
  label: string
  value: string | number
  description: string
  valueClassName?: string
}

export default function StatisticCard({ label, value, description, valueClassName }: StatisticCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
        <div className={cn("text-3xl font-bold", valueClassName)}>{value}</div>
        <div className="text-xs text-muted-foreground mt-2">{description}</div>
      </CardContent>
    </Card>
  )
}
