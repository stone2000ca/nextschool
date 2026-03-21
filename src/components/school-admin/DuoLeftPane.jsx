'use client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import KeyFactsList from '@/components/school-admin/KeyFactsList'

export default function DuoLeftPane() {
  return (
    <Tabs defaultValue="preview" className="flex flex-col h-full">
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
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Analytics coming soon.
          </div>
        </TabsContent>
      </div>
    </Tabs>
  )
}
