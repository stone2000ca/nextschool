'use client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import KeyFactsList from '@/components/school-admin/KeyFactsList'
import AnalyticsTab from '@/components/school-admin/AnalyticsTab'

export default function DuoLeftPane({ schoolId, onSectionChange }) {
  return (
    <Tabs
      defaultValue="preview"
      className="flex flex-col h-full"
      onValueChange={(val) => {
        // When switching to keyfacts tab, notify parent
        if (val === 'keyfacts' && onSectionChange) {
          onSectionChange({ title: 'Key Facts', fields: [] })
        } else if (onSectionChange) {
          onSectionChange(null)
        }
      }}
    >
      <div className="border-b border-border px-4 pt-3 shrink-0">
        <TabsList className="bg-muted">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="keyfacts">Key Facts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-y-auto">
        <TabsContent value="preview" className="mt-0">
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Profile preview coming soon.
          </div>
        </TabsContent>

        <TabsContent value="keyfacts" className="mt-0">
          <KeyFactsList />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <AnalyticsTab schoolId={schoolId} />
        </TabsContent>
      </div>
    </Tabs>
  )
}
