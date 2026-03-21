'use client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import SchoolPreviewTab from '@/components/school-admin/preview/SchoolPreviewTab'
import KeyFactsTab from '@/components/school-admin/KeyFactsTab'
import AnalyticsTab from '@/components/school-admin/AnalyticsTab'

export default function DuoLeftPane({ schoolId, school, onSchoolUpdate, onSectionChange }) {
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
          {school ? (
            <SchoolPreviewTab school={school} onEditWithAi={(section) => {
              if (onSectionChange) onSectionChange(section)
            }} />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Loading preview…
            </div>
          )}
        </TabsContent>

        <TabsContent value="keyfacts" className="mt-0">
          {school ? (
            <KeyFactsTab school={school} onSchoolUpdate={onSchoolUpdate} />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Loading…
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <AnalyticsTab schoolId={schoolId} />
        </TabsContent>
      </div>
    </Tabs>
  )
}
