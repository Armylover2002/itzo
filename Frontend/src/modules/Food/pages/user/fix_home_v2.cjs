const fs = require('fs');
const path = 'z:/projects/appzeto-zomato/Frontend/src/modules/Food/pages/user/Home.jsx';
let content = fs.readFileSync(path, 'utf8');

const anchor = '                              </CardContent>\n                            </div>';
const replacement = `                              </CardContent>\n                            </div>\n\n                            {/* Border Glow Effect */}\n                            <div className="absolute inset-0 rounded-md pointer-events-none z-0 transition-all duration-300 border border-transparent group-hover:border-[#EB590E]/30 group-hover:shadow-[inset_0_0_0_1px_rgba(235,89,14,0.2)]" />\n                          </Card>\n                        </Link>\n                      </div>\n                    </LazyComponent>\n                  </div>\n                );`;

if (content.indexOf(anchor) === -1) {
    console.error('Anchor not found!');
    process.exit(1);
}

content = content.replace(anchor, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed Home.jsx');
