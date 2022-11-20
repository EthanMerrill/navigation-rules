export function styleParse(transformstyle: string) {
    let matchArr = transformstyle.match(/([\w]+)\(([^\)]+)\)/g);
    if (matchArr) {
      return matchArr
        .map(function (it: string) {
          return it.replace(/\)$/, "").split(/\(/);
        })
        .reduce(function (m: any, it: any) {
          return (m[it[0]] = it[1]), m;
        }, {});
    }
  }
