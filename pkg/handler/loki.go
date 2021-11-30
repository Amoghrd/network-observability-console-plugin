package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/httpclient"
	"github.com/sirupsen/logrus"
)

var hlog = logrus.WithField("module", "handler")

const getFlowsURLPath = `/loki/api/v1/query_range?query={app="netobserv-flowcollector"}`

func GetFlows(lokiURL *url.URL, timeout time.Duration) func(w http.ResponseWriter, r *http.Request) {
	flowsURL := strings.TrimRight(lokiURL.String(), "/") + getFlowsURLPath

	return func(w http.ResponseWriter, r *http.Request) {
		// TODO: loki with auth
		resp, code, err := httpclient.HTTPGet(flowsURL, timeout)
		if err != nil {
			writeError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		if code != http.StatusOK {
			msg := getLokiError(resp, code)
			writeError(w, http.StatusServiceUnavailable, msg)
			return
		}
		hlog.Infof("GetFlows raw response: %v", string(resp)) // TODO: remove logs
		writeRawJSON(w, http.StatusOK, resp)
	}
}

func getLokiError(resp []byte, code int) string {
	var f map[string]string
	err := json.Unmarshal(resp, &f)
	if err != nil {
		return fmt.Sprintf("Unknown error from Loki - cannot unmarshal (code: %d)", code)
	}
	message, ok := f["message"]
	if !ok {
		return fmt.Sprintf("Unknown error from Loki - no message found (code: %d)", code)
	}
	return fmt.Sprintf("Error from Loki (code: %d): %s", code, message)
}

func writeRawJSON(w http.ResponseWriter, code int, payload []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, err := w.Write(payload)
	if err != nil {
		hlog.Errorf("Error while responding raw JSON: %v", err)
	}
}

type errorResponse struct{ Message string }

func writeError(w http.ResponseWriter, code int, message string) {
	response, err := json.Marshal(errorResponse{Message: message})
	if err != nil {
		hlog.Errorf("Marshalling error while responding an error: %v (message was: %s)", err, message)
		code = http.StatusInternalServerError
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, err = w.Write(response)
	if err != nil {
		hlog.Errorf("Error while responding an error: %v (message was: %s)", err, message)
	}
}
