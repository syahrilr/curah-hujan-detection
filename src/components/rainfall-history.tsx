'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  RefreshCw,
  Search,
  Image as ImageIcon,
  Trash2,
  Calendar,
  MapPin,
  Droplets,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'

interface RainfallRecord {
  id: string
  locationName: string
  timestamp: string
  radarStation: string
  notes: string
  metadata: {
    dbz: number
    rainRate: number
    intensity: string
    confidence: string
    radarTime: string
  }
  isAutoDetected?: boolean
  createdAt: string
}

export default function RainfallHistory() {
  const [records, setRecords] = useState<RainfallRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    station: '',
    intensity: '',
  })

  useEffect(() => {
    fetchRecords()
  }, [page, filters])

  const fetchRecords = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: '10',
        skip: String((page - 1) * 10),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.station && { radarStation: filters.station }),
        ...(filters.intensity && { intensity: filters.intensity }),
      })

      const response = await fetch(`/api/rainfall?${params}`)
      const data = await response.json()

      if (data.success) {
        setRecords(data.data)
        setTotalPages(data.pagination.totalPages)
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch records')
      }
    } catch (err) {
      setError('Network error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const deleteRecord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return

    try {
      const response = await fetch(`/api/rainfall?id=${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        fetchRecords()
      } else {
        alert('Failed to delete: ' + data.error)
      }
    } catch (err) {
      alert('Network error')
    }
  }

  const viewScreenshot = (id: string) => {
    window.open(`/api/rainfall?id=${id}&action=screenshot`, '_blank')
  }

  const getIntensityVariant = (intensity: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'No Rain': 'outline',
      'Light Rain': 'secondary',
      'Moderate Rain': 'default',
      'Heavy Rain': 'destructive',
      'Very Heavy Rain': 'destructive',
    }
    return variants[intensity] || 'outline'
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Rainfall History</h1>
            <p className="text-muted-foreground mt-2">
              Browse and analyze past rainfall records
            </p>
          </div>
          <Button onClick={fetchRecords} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>Filter records by date, station, or intensity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="station">Radar Station</Label>
                <Select value={filters.station} onValueChange={(value) => setFilters({ ...filters, station: value })}>
                  <SelectTrigger id="station">
                    <SelectValue placeholder="All stations" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* <SelectItem value="all">All stations</SelectItem> */}
                    <SelectItem value="JAK">Jakarta (JAK)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="intensity">Intensity</Label>
                <Select value={filters.intensity} onValueChange={(value) => setFilters({ ...filters, intensity: value })}>
                  <SelectTrigger id="intensity">
                    <SelectValue placeholder="All intensities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All intensities</SelectItem>
                    <SelectItem value="No Rain">No Rain</SelectItem>
                    <SelectItem value="Light Rain">Light Rain</SelectItem>
                    <SelectItem value="Moderate Rain">Moderate Rain</SelectItem>
                    <SelectItem value="Heavy Rain">Heavy Rain</SelectItem>
                    <SelectItem value="Very Heavy Rain">Very Heavy Rain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Records</CardTitle>
            <CardDescription>Total: {records.length} records found</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : records.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Intensity</TableHead>
                      <TableHead>Rain Rate</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{record.locationName}</div>
                              <div className="text-xs text-muted-foreground">
                                {record.radarStation}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div className="text-sm">
                              {new Date(record.timestamp).toLocaleString('id-ID', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getIntensityVariant(record.metadata.intensity)}>
                            {record.metadata.intensity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Droplets className="h-4 w-4 text-blue-500" />
                            {record.metadata.rainRate.toFixed(2)} mm/h
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.isAutoDetected ? 'default' : 'secondary'}>
                            {record.isAutoDetected ? 'Auto' : 'Manual'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                  <ImageIcon className="h-4 w-4" />
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl">
                                <DialogHeader>
                                  <DialogTitle>{record.locationName}</DialogTitle>
                                  <DialogDescription>
                                    {new Date(record.timestamp).toLocaleString('id-ID')}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <div className="text-muted-foreground">Intensity</div>
                                      <div className="font-semibold">{record.metadata.intensity}</div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">Rain Rate</div>
                                      <div className="font-semibold">{record.metadata.rainRate.toFixed(2)} mm/h</div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">dBZ</div>
                                      <div className="font-semibold">{record.metadata.dbz.toFixed(1)}</div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">Confidence</div>
                                      <div className="font-semibold">{record.metadata.confidence}</div>
                                    </div>
                                  </div>
                                  {record.notes && (
                                    <div>
                                      <div className="text-sm text-muted-foreground">Notes</div>
                                      <div className="text-sm">{record.notes}</div>
                                    </div>
                                  )}
                                  <Button onClick={() => viewScreenshot(record.id)} className="gap-2">
                                    <ImageIcon className="h-4 w-4" />
                                    View Full Screenshot
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteRecord(record.id)}
                              className="gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="gap-2"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No records found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters or add new records from the monitoring page
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
