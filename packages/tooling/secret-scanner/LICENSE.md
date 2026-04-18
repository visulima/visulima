MIT License

Copyright (c) 2026 visulima

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

# Third-party notices for bundled detection rulesets

The @visulima/secret-scanner source code is licensed under the MIT License above.
The bundled detection rulesets are licensed separately from @visulima/secret-scanner
itself and carry their own attribution requirements.

The shipped `data/ruleset.json` carries a `provenance.sources[]` block with the
exact upstream ref, commit SHA, license name, and license-file reference for
each contributing source, so downstream audit tooling can match every rule back
to its origin without parsing this file.

## Gitleaks ruleset

Rules whose `source` field is `"gitleaks"` in `data/ruleset.json`.

- Copyright (c) 2019 Zachary Rice
- Source: https://github.com/gitleaks/gitleaks
- License: MIT — see `data/LICENSE-GITLEAKS`, copied verbatim from the pinned
  upstream ref during `pnpm run build:rules`.

## Kingfisher ruleset

Rules whose `source` field is `"kingfisher"` in `data/ruleset.json`.

- Copyright 2025 MongoDB, Inc.
- Source: https://github.com/mongodb/kingfisher
- License: Apache License 2.0 — see `data/LICENSE-KINGFISHER`, copied verbatim
  from the pinned upstream ref during `pnpm run build:rules`.

The upstream Kingfisher `NOTICE` file — which carries derivative attribution
for rules drawn from Nosey Parker (Apache-2.0), Titus (Apache-2.0), Betterleaks
(MIT), and Gitleaks (MIT) — is shipped verbatim as `data/NOTICE-KINGFISHER`
and refreshed on every `pnpm run build:rules` from the pinned upstream ref.
Consult that file for the complete attribution text; we intentionally do not
duplicate it here to avoid drift.

<!-- DEPENDENCIES -->

# Licenses of bundled dependencies
The published @visulima/secret-scanner artifact additionally contains code with the following licenses:
MIT

# Bundled dependencies:
## @visulima/fs
License: MIT
By: Daniel Bannert
Repository: git+https://github.com/visulima/visulima.git

> MIT License
>
> Copyright (c) 2026 visulima
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
>
>
>
> # Licenses of bundled dependencies
> The published @visulima/fs artifact additionally contains code with the following licenses:
> ISC, MIT
>
> # Bundled dependencies:
> ## @visulima/error
> License: MIT
> By: Daniel Bannert
> Repository: git+https://github.com/visulima/visulima.git
>
> > MIT License
> >
> > Copyright (c) 2026 visulima
> >
> > Permission is hereby granted, free of charge, to any person obtaining a copy
> > of this software and associated documentation files (the "Software"), to deal
> > in the Software without restriction, including without limitation the rights
> > to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> > copies of the Software, and to permit persons to whom the Software is
> > furnished to do so, subject to the following conditions:
> >
> > The above copyright notice and this permission notice shall be included in all
> > copies or substantial portions of the Software.
> >
> > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> > IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> > FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> > LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> > SOFTWARE.
> >
> >
> >
> > # Licenses of bundled dependencies
> >
> > The published @visulima/error artifact additionally contains code with the following licenses:
> > MIT
> >
> > # Bundled dependencies:
> >
> > ## is-plain-obj
> >
> > License: MIT
> > By: Sindre Sorhus
> > Repository: sindresorhus/is-plain-obj
> >
> > > MIT License
> > >
> > > Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
> > >
> > > Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
> > >
> > > The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
> > >
> > > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
>
> ---------------------------------------
>
> ## detect-indent
> License: MIT
> By: Sindre Sorhus
> Repository: sindresorhus/detect-indent
>
> > MIT License
> >
> > Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
> >
> > Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
> >
> > The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
> >
> > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
>
> ---------------------------------------
>
> ## fdir
> License: MIT
> By: thecodrr
> Repository: git+https://github.com/thecodrr/fdir.git
>
> > Copyright 2023 Abdullah Atta
> >
> > Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
> >
> > The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
> >
> > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
>
> ---------------------------------------
>
> ## glob-parent
> License: ISC
> By: Gulp Team, Elan Shanker, Blaine Bublitz
> Repository: gulpjs/glob-parent
>
> > The ISC License
> >
> > Copyright (c) 2015, 2019 Elan Shanker, 2021 Blaine Bublitz <blaine.bublitz@gmail.com>, Eric Schoffstall <yo@contra.io> and other contributors
> >
> > Permission to use, copy, modify, and/or distribute this software for any
> > purpose with or without fee is hereby granted, provided that the above
> > copyright notice and this permission notice appear in all copies.
> >
> > THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
> > WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
> > MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
> > ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
> > WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
> > ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
> > IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
>
> ---------------------------------------
>
> ## is-extglob
> License: MIT
> By: Jon Schlinkert
> Repository: jonschlinkert/is-extglob
>
> > The MIT License (MIT)
> >
> > Copyright (c) 2014-2016, Jon Schlinkert
> >
> > Permission is hereby granted, free of charge, to any person obtaining a copy
> > of this software and associated documentation files (the "Software"), to deal
> > in the Software without restriction, including without limitation the rights
> > to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> > copies of the Software, and to permit persons to whom the Software is
> > furnished to do so, subject to the following conditions:
> >
> > The above copyright notice and this permission notice shall be included in
> > all copies or substantial portions of the Software.
> >
> > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> > IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> > FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> > LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> > THE SOFTWARE.
>
> ---------------------------------------
>
> ## is-fs-case-sensitive
> License: MIT
> By: Hiroki Osame
> Repository: privatenumber/is-fs-case-sensitive
>
> > MIT License
> >
> > Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
> >
> > Permission is hereby granted, free of charge, to any person obtaining a copy
> > of this software and associated documentation files (the "Software"), to deal
> > in the Software without restriction, including without limitation the rights
> > to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> > copies of the Software, and to permit persons to whom the Software is
> > furnished to do so, subject to the following conditions:
> >
> > The above copyright notice and this permission notice shall be included in all
> > copies or substantial portions of the Software.
> >
> > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> > IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> > FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> > LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> > SOFTWARE.
>
> ---------------------------------------
>
> ## is-glob
> License: MIT
> By: Jon Schlinkert, Brian Woodward, Daniel Perez
> Repository: micromatch/is-glob
>
> > The MIT License (MIT)
> >
> > Copyright (c) 2014-2017, Jon Schlinkert.
> >
> > Permission is hereby granted, free of charge, to any person obtaining a copy
> > of this software and associated documentation files (the "Software"), to deal
> > in the Software without restriction, including without limitation the rights
> > to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> > copies of the Software, and to permit persons to whom the Software is
> > furnished to do so, subject to the following conditions:
> >
> > The above copyright notice and this permission notice shall be included in
> > all copies or substantial portions of the Software.
> >
> > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> > IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> > FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> > LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> > THE SOFTWARE.
>
> ---------------------------------------
>
> ## picomatch
> License: MIT
> By: Jon Schlinkert
> Repository: micromatch/picomatch
>
> > The MIT License (MIT)
> >
> > Copyright (c) 2017-present, Jon Schlinkert.
> >
> > Permission is hereby granted, free of charge, to any person obtaining a copy
> > of this software and associated documentation files (the "Software"), to deal
> > in the Software without restriction, including without limitation the rights
> > to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> > copies of the Software, and to permit persons to whom the Software is
> > furnished to do so, subject to the following conditions:
> >
> > The above copyright notice and this permission notice shall be included in
> > all copies or substantial portions of the Software.
> >
> > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> > IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> > FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> > LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> > THE SOFTWARE.
>
> ---------------------------------------
>
> ## tinyglobby
> License: MIT
> By: Superchupu
> Repository: git+https://github.com/SuperchupuDev/tinyglobby.git
>
> > MIT License
> >
> > Copyright (c) 2024 Madeline Gurriarán
> >
> > Permission is hereby granted, free of charge, to any person obtaining a copy
> > of this software and associated documentation files (the "Software"), to deal
> > in the Software without restriction, including without limitation the rights
> > to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> > copies of the Software, and to permit persons to whom the Software is
> > furnished to do so, subject to the following conditions:
> >
> > The above copyright notice and this permission notice shall be included in all
> > copies or substantial portions of the Software.
> >
> > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> > IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> > FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> > LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> > SOFTWARE.
>
>
>
>
>
> # Licenses of bundled types
>
> The published @visulima/fs artifact additionally contains code with the following licenses:
> MIT
>
> # Bundled types:
>
> ## is-fs-case-sensitive
>
> License: MIT
> By: Hiroki Osame
> Repository: privatenumber/is-fs-case-sensitive
>
> > MIT License
> >
> > Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
> >
> > Permission is hereby granted, free of charge, to any person obtaining a copy
> > of this software and associated documentation files (the "Software"), to deal
> > in the Software without restriction, including without limitation the rights
> > to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> > copies of the Software, and to permit persons to whom the Software is
> > furnished to do so, subject to the following conditions:
> >
> > The above copyright notice and this permission notice shall be included in all
> > copies or substantial portions of the Software.
> >
> > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> > IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> > FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> > LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> > SOFTWARE.

---------------------------------------

## @visulima/path
License: MIT
By: Daniel Bannert
Repository: git+https://github.com/visulima/visulima.git

> MIT License
>
> Copyright (c) 2026 visulima
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
>
> ---
>
> MIT License
>
> Copyright (c) Pooya Parsa <pooya@pi0.io> - Daniel Roe <daniel@roe.dev>
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
>
> ---
>
> Copyright Joyent, Inc. and other Node contributors.
>
> Permission is hereby granted, free of charge, to any person obtaining a
> copy of this software and associated documentation files (the
> "Software"), to deal in the Software without restriction, including
> without limitation the rights to use, copy, modify, merge, publish,
> distribute, sublicense, and/or sell copies of the Software, and to permit
> persons to whom the Software is furnished to do so, subject to the
> following conditions:
>
> The above copyright notice and this permission notice shall be included
> in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
> OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
> MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
> NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
> DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
> USE OR OTHER DEALINGS IN THE SOFTWARE.
>
> ---
>
> Bundled zeptomatch (https://github.com/fabiospampinato/zeptomatch)
>
> The MIT License (MIT)
>
> Copyright (c) 2023-present Fabio Spampinato
>
> Permission is hereby granted, free of charge, to any person obtaining a
> copy of this software and associated documentation files (the "Software"),
> to deal in the Software without restriction, including without limitation
> the rights to use, copy, modify, merge, publish, distribute, sublicense,
> and/or sell copies of the Software, and to permit persons to whom the
> Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
> FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
> DEALINGS IN THE SOFTWARE.
>
>
>
> # Licenses of bundled dependencies
>
> The published @visulima/path artifact additionally contains code with the following licenses:
> MIT
>
> # Bundled dependencies:
>
> ## binary-extensions
>
> License: MIT
> By: Sindre Sorhus
> Repository: sindresorhus/binary-extensions
>
> > MIT License
> >
> > Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
> > Copyright (c) Paul Miller (https://paulmillr.com)
> >
> > Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
> >
> > The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
> >
> > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

<!-- /DEPENDENCIES -->

<!-- TYPE_DEPENDENCIES -->
<!-- /TYPE_DEPENDENCIES -->
