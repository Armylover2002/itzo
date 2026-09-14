import { ChevronDown } from "lucide-react"

export default function RestaurantMenuSections({
  filteredSections,
  hasActiveMenuFilters,
  expandedSections,
  setExpandedSections,
  isRecommendedSection,
  toRenderableArray,
  loadingMenuItems,
  renderDishCard,
}) {
  return (
    <>
                  {filteredSections.length === 0 && hasActiveMenuFilters && (
                    <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] px-5 py-8 text-center">
                      <p className="text-sm md:text-base font-medium text-gray-700 dark:text-gray-300">
                        No dishes match the selected filters.
                      </p>
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Clear filters or try a different combination.
                      </p>
                    </div>
                  )}
                  {filteredSections.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
                      No dishes match the current filters.
                    </div>
                  )}
      
                  {filteredSections.map(({ section, originalIndex }, sectionIndex) => {
                    // Handle section name - check for valid non-empty string
                    const isRecommended = isRecommendedSection(section)
                    const sectionId = `menu-section-${originalIndex}`
                    const sectionItems = toRenderableArray(section?.items)
                    const sectionSubsections = toRenderableArray(section?.subsections)
      
                    const isExpanded = expandedSections.has(originalIndex)
      
                    return (
                      <div key={sectionIndex} id={sectionId} className="scroll-mt-28">
                        {/* Section Header */}
                        {isRecommended && (
                          <div className="flex items-center justify-between mb-4 px-1">
                            <h2 className="text-xl font-bold capitalize text-gray-900 dark:text-white tracking-tight">
                              Recommended for you
                            </h2>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedSections(prev => {
                                  const newSet = new Set(prev)
                                  if (newSet.has(originalIndex)) {
                                    newSet.delete(originalIndex)
                                  } else {
                                    newSet.add(originalIndex)
                                  }
                                  return newSet
                                })
                              }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                            >
                              <ChevronDown
                                className={`h-5 w-5 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'
                                  }`}
                              />
                            </button>
                          </div>
                        )}
                        {!isRecommended && (
                          <div className="flex items-center justify-between mb-4 px-1">
                            <div className="space-y-1">
                              <h2 className="text-xl font-bold capitalize text-gray-900 dark:text-white tracking-tight">
                                {(section?.name && typeof section.name === 'string' && section.name.trim())
                                  ? section.name.trim()
                                  : (section?.title && typeof section.title === 'string' && section.title.trim())
                                    ? section.title.trim()
                                    : "Unnamed Section"}
                              </h2>
                              {section.subtitle && (
                                <button className="text-sm text-blue-600 dark:text-blue-400 underline">
                                  {section.subtitle}
                                </button>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedSections(prev => {
                                  const newSet = new Set(prev)
                                  if (newSet.has(originalIndex)) {
                                    newSet.delete(originalIndex)
                                  } else {
                                    newSet.add(originalIndex)
                                  }
                                  return newSet
                                })
                              }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                            >
                              <ChevronDown
                                className={`h-5 w-5 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'
                                  }`}
                              />
                            </button>
                          </div>
                        )}
      
                        {/* Direct Items */}
                        {isExpanded && isRecommended && !loadingMenuItems && sectionItems.length === 0 && (
                          <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">
                              No dish recommended
                            </p>
                          </div>
                        )}
                        {isExpanded && loadingMenuItems && (
                          <div className="space-y-3 px-1 py-2 animate-pulse">
                            <div className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800" />
                            <div className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800" />
                          </div>
                        )}
                        {isExpanded && sectionItems.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 px-1 pb-2">
                            {sectionItems.map((item) => renderDishCard(item))}
                          </div>
                        )}
      
                        {/* Subsections */}
                        {isExpanded && sectionSubsections.length > 0 && (
                          <div className="space-y-4">
                            {sectionSubsections.map((subsection, subIndex) => {
                              const subsectionKey = `${originalIndex}-${subIndex}`
                              const isSubsectionExpanded = expandedSections.has(subsectionKey)
                              const subsectionItems = toRenderableArray(subsection?.items)
      
                              return (
                                <div key={subIndex} className="space-y-4">
                                  {/* Subsection Header */}
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                      {subsection?.name || subsection?.title || "Subsection"}
                                    </h3>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setExpandedSections(prev => {
                                          const newSet = new Set(prev)
                                          if (newSet.has(subsectionKey)) {
                                            newSet.delete(subsectionKey)
                                          } else {
                                            newSet.add(subsectionKey)
                                          }
                                          return newSet
                                        })
                                      }}
                                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                    >
                                      <ChevronDown
                                        className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isSubsectionExpanded ? '' : '-rotate-90'
                                          }`}
                                      />
                                    </button>
                                  </div>
      
                                  {/* Subsection Items */}
                                  {isSubsectionExpanded && subsectionItems.length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 px-1 pb-2">
                                      {subsectionItems.map((item) => renderDishCard(item))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
      
    </>
  );
}
