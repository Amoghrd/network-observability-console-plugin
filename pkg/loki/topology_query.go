package loki

import (
	"fmt"
	"strconv"
)

const (
	topologyDefaultLimit = "100"
	topologyDefaultRange = "300"
	topologyMetrics      = "SrcK8S_Name,SrcK8S_Type,SrcK8S_OwnerName,SrcK8S_OwnerType,SrcK8S_Namespace,SrcAddr,SrcK8S_HostIP,DstK8S_Name,DstK8S_Type,DstK8S_OwnerName,DstK8S_OwnerType,DstK8S_Namespace,DstAddr,DstK8S_HostIP"
)

type Topology struct {
	limit          string
	timeRange      string
	metricFunction string
	dataField      string
}

type TopologyQueryBuilder struct {
	*FlowQueryBuilder
	topology *Topology
}

func NewTopologyQuery(cfg *Config, start, end, limit, metricFunction, metricType, reporter string) (*TopologyQueryBuilder, error) {
	l := limit
	if len(l) == 0 {
		l = topologyDefaultLimit
	}

	timeRange := topologyDefaultRange
	if len(start) > 0 && len(end) > 0 {
		var startTime, endTime int64
		var err error
		startTime, err = strconv.ParseInt(start, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("can't parse start param: %s", start)
		}
		endTime, err = strconv.ParseInt(end, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("can't parse end param: %s", end)
		}
		rng := endTime - startTime
		if rng > 0 {
			timeRange = strconv.FormatInt(rng, 10)
		}
	}

	var f string
	switch metricFunction {
	case "avg":
		f = "avg_over_time"
	case "max":
		f = "max_over_time"
	case "rate":
		f = "rate"
	default:
		f = "sum_over_time"
	}

	var t string
	switch metricType {
	case "packets":
		t = "Packets"
	default:
		t = "Bytes"
	}

	return &TopologyQueryBuilder{
		FlowQueryBuilder: NewFlowQueryBuilder(cfg, start, end, limit, reporter),
		topology: &Topology{
			timeRange:      timeRange,
			limit:          l,
			metricFunction: f,
			dataField:      t,
		},
	}, nil
}

func (q *TopologyQueryBuilder) Build() string {
	// Build topology query like:
	// /<url path>?query=
	//		topk(
	// 			<k>,
	//			sum by(<aggregations>) (
	//				sum_over_time(
	//					{<label filters>}|<line filters>|json|<json filters>
	//						|unwrap Bytes|__error__=""[300s]
	//				)
	//			)
	//		)
	//		&<query params>&step=300s
	sb := q.createStringBuilderURL()
	sb.WriteString("topk(")
	sb.WriteString(q.topology.limit)
	sb.WriteString(",sum by(")
	sb.WriteString(topologyMetrics)
	sb.WriteString(") (")
	sb.WriteString(q.topology.metricFunction)
	sb.WriteString("(")
	q.appendLabels(sb)
	q.appendLineFilters(sb)
	q.appendJSON(sb, true)
	if q.topology.metricFunction != "rate" && len(q.topology.dataField) > 0 {
		sb.WriteString("|unwrap ")
		sb.WriteString(q.topology.dataField)
		sb.WriteString(`|__error__=""`)
	}
	sb.WriteRune('[')
	sb.WriteString(q.topology.timeRange)
	sb.WriteString("s])))")
	q.appendQueryParams(sb)
	//TODO: check if step should be configurable. 60s is forced to help calculations on front end side
	sb.WriteString("&step=60s")

	return sb.String()
}