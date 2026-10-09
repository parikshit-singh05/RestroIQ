export function InventorySkeleton() {
  return (
    <div className="max-w-[1120px] mx-auto animate-pulse pb-16">
      <div className="h-10 bg-[rgba(20,19,15,0.06)] rounded w-3/4 mb-4" />
      <div className="h-32 bg-[rgba(20,19,15,0.04)] rounded-lg mb-10 w-[800px]" />
      
      <div className="h-4 bg-[rgba(20,19,15,0.06)] w-32 mb-4" />
      <div className="grid grid-cols-4 gap-4 mb-10">
        <div className="h-32 bg-[rgba(20,19,15,0.04)] rounded-lg" />
        <div className="h-32 bg-[rgba(20,19,15,0.04)] rounded-lg" />
        <div className="h-32 bg-[rgba(20,19,15,0.04)] rounded-lg" />
        <div className="h-32 bg-[rgba(20,19,15,0.04)] rounded-lg" />
      </div>

      <div className="h-24 bg-[rgba(20,19,15,0.02)] rounded-lg mb-8" />
      <div className="h-[300px] bg-[rgba(20,19,15,0.02)] rounded-lg mb-8" />
    </div>
  )
}
