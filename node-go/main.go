package main

import (
	"encoding/json"
	"os"
	"os/exec"

	"github.com/zealic/go2node"
)

type Cmd []string

func main() {
	channel, err := go2node.RunAsNodeChild()
	if err != nil {
		panic(err)
	}
	for {
		// Golang will output: {"hello":"child"}
		m, err := channel.Read()
		if err != nil {
			panic(err)
		}
		var msg struct {
			Msg []string `json:"msg"`
		}
		if err := json.Unmarshal(m.Message, &msg); err != nil {
			panic(err)
		}
		cmd := exec.Command(msg.Msg[0], msg.Msg[1:]...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		_ = cmd.Run()

		err = channel.Write(&go2node.NodeMessage{
			Message: []byte(`["exit", 0]`),
		})
		if err != nil {
			panic(err)
		}
	}
}
