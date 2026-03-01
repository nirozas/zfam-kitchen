import { Skeleton } from "./ui/skeleton";

export default function RecipeCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 h-full">
            <div className="aspect-[3/2] relative">
                <Skeleton className="w-full h-full rounded-none" />
                <div className="absolute top-3 left-3">
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="absolute top-3 right-3 flex flex-col gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
            </div>

            <div className="p-2 sm:p-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-12" />
                        <div className="w-px h-3 bg-gray-100" />
                        <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                </div>

                <Skeleton className="h-5 w-3/4 mb-1" />
                <Skeleton className="hidden sm:block h-3 w-full mb-1" />
                <Skeleton className="hidden sm:block h-3 w-2/3 mb-3" />

                <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-16" />
                </div>
            </div>
        </div>
    );
}
