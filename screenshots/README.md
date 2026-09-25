# Screenshots

- `test-output.png`: `npm test` output. 12/12 tests pass against the compiled `contracts/shadowpoll.compact`.
- `compile-output.txt`: output of `compact compile contracts/shadowpoll.compact managed/shadowpoll` (compiler 0.31.1) and the generated files for the two circuits, `voteYes` and `voteNo`.
- `preprod-deploy-verify.txt`: the public Midnight **Preprod** indexer confirming the deployed contract `d96f15b971d60aa20ce22533e54072871f66a23b6819b0961203437f1a3abf3a` (`ContractDeploy`, tx `9a2d541f…44fd`, block `2601023`). Anyone can re-run the same query.
