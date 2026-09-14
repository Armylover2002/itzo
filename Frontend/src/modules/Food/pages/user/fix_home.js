const fs = require('fs');
const path = 'z:/projects/appzeto-zomato/Frontend/src/modules/Food/pages/user/Home.jsx';
let content = fs.readFileSync(path, 'utf8');
const searchString = '{/* Border Glow Effect */}';
const replacement = `{/* Border Glow Effect */}
                            <div className="absolute inset-0 rounded-md pointer-events-none z-0 transition-all duration-300 border border-transparent group-hover:border-[#EB590E]/30 group-hover:shadow-[inset_0_0_0_1px_rgba(235,89,14,0.2)]" />
                           </Card>
                         </Link>
                       </div>
                     </LazyComponent>
                   </div>
                 );`;
content = content.replace(searchString, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed Home.jsx');
